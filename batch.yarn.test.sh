#!/bin/bash

# 创建或清空日志文件
log_file="test_results.log"
> "$log_file"

# 循环执行 yarn test 100 次
for i in {1..100}; do
   echo "Running test iteration $i"
   if yarn test; then
      # 如果测试成功，记录成功信息
      echo "Test $i: SUCCESS" >> "$log_file"
   else
      # 如果测试失败，记录失败信息
      echo "Test $i: FAILED" >> "$log_file"
   fi
done

echo "Testing completed. Results are in $log_file"
