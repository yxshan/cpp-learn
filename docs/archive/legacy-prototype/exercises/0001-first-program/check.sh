#!/bin/sh

set -eu

exercise_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
binary_path="$exercise_dir/first_program"

clang++ \
  -std=c++20 \
  -Wall \
  -Wextra \
  -Wpedantic \
  "$exercise_dir/main.cpp" \
  -o "$binary_path"

program_output=$(printf 'Lin\n90\n' | "$binary_path")
printf '%s\n' "$program_output"

case "$program_output" in
  *"欢迎，Lin！"*"3 个完整番茄钟"*"15 分钟"*)
    printf '\n检查通过：编译成功，计算和输出都符合要求。\n'
    ;;
  *)
    printf '\n检查未通过：请确认输出包含名字 Lin、3 个完整番茄钟和剩余 15 分钟。\n' >&2
    exit 1
    ;;
esac
