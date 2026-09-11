#!/bin/sh
#
# LEGACY PROTOTYPE — NOT A JUDGING PATH.
#
# This script compiles and runs the prototype program directly on the host with
# no timeout, no output limit, no environment filtering and no process-group
# cleanup. The supported way to run and grade an Activity is the CLI, which goes
# through the Judge (see docs/adr/0004-native-judge-first.md):
#
#     ./cpplearn check --activity <activity-id>
#
# Kept only as the historical record of the first exercise. Do not extend it and
# do not treat its result as Evidence.

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
