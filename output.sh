#!/bin/bash

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <src_directory> <output_file>"
  exit 1
fi

src_dir="$1"
output_file="$2"

> "$output_file"

find "$src_dir" -type f ! -path "$src_dir/.git/*" | while read -r file; do
  relative_path="${file#$src_dir/}"
  echo -e "\n\n==== /$relative_path ====\n" >> "$output_file"
  cat "$file" >> "$output_file"
done

echo "done concatenating files from $src_dir into $output_file"
