#!/usr/bin/env bash
# Ежедневный дамп PostgreSQL. Ставится на сервер выкладкой (см. deploy.yml)
# и запускается из crontab пользователя sovenok — root не нужен.
#
# Формат -Fc (custom, сжатый): восстанавливается pg_restore целиком или
# выборочно по таблицам, в отличие от простого SQL-текста. Восстановление:
#   docker compose exec -T postgres pg_restore -U sovenok -d sovenok --clean < файл.dump
#
# Дампы содержат персональные данные детей и родителей, поэтому каталог 700,
# файлы 600. Наружу они пока не уезжают — это отдельный шаг, см. README.
set -euo pipefail

DIR=/home/sovenok/edtech
OUT=/home/sovenok/backups
KEEP=30

mkdir -p "$OUT"
chmod 700 "$OUT"

# Логи и вывод — в файл: cron иначе пытается слать почту, которой здесь нет.
exec >>"$OUT/backup.log" 2>&1

# Два дампа разом читали бы одну базу и писали в один каталог. Если прошлый
# запуск ещё идёт (или завис), этот молча уходит, а не наслаивается.
exec 9>"$OUT/.lock"
if ! flock -n 9; then
	echo "$(date -Is) пропуск: предыдущий дамп ещё выполняется"
	exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$OUT/.sovenok-$STAMP.part"
DST="$OUT/sovenok-$STAMP.dump"

echo "$(date -Is) начало"
cd "$DIR"

umask 077
# Пишем во временный файл: оборвавшийся дамп не должен выглядеть как готовый.
if ! docker compose exec -T postgres pg_dump -U sovenok -d sovenok -Fc >"$TMP"; then
	echo "$(date -Is) ОШИБКА: pg_dump не отработал"
	rm -f "$TMP"
	exit 1
fi

# Проверяем целостность до ротации. Иначе битый дамп вытеснил бы из хранения
# рабочую копию — худший вид бэкапа: он есть, но не восстанавливается.
# pg_restore живёт в контейнере, на хосте его нет, поэтому читаем через stdin.
if ! docker compose exec -T postgres pg_restore -l >/dev/null <"$TMP"; then
	echo "$(date -Is) ОШИБКА: дамп получился нечитаемым, ротацию не делаю"
	rm -f "$TMP"
	exit 1
fi

mv "$TMP" "$DST"
chmod 600 "$DST"
echo "$(date -Is) готов $DST ($(du -h "$DST" | cut -f1))"

# Ротация — только после успешной проверки выше.
ls -1t "$OUT"/sovenok-*.dump 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
	echo "$(date -Is) удаляю старый $old"
	rm -f "$old"
done

# Отметка последнего успеха: у cron некуда жаловаться, поэтому наличие свежего
# дампа надо уметь проверить одной командой — `cat backups/.last-success`.
date -Is >"$OUT/.last-success"
echo "$(date -Is) конец, всего копий: $(ls -1 "$OUT"/sovenok-*.dump 2>/dev/null | wc -l)"
