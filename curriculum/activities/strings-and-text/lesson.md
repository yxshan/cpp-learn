# 字符串与文本

JavaScript 的字符串是不可变值，切片和拼接都产生新字符串；C++ 的 `std::string` 是**可变的值类型**，而且 `size()` 数的是字节，不是用户感知的字符。读取一行文本，输出字节数与全大写副本。

`std::string` 是连续容器：字符存放在一段连续内存里，所以按下标访问很快，但任何可能重新分配或修改内容的非 const 成员调用都会让先前取得的引用、指针和迭代器失效——标准在 `[string.require]` 里明确列出了这些来源，`std::getline` 也在其中。这与 JavaScript 里"字符串永不变"的直觉正好相反。

## 任务

从标准输入读取一整行（可能含空格，用 `std::getline`），输出两行：这一行的字节数，以及把 `a`–`z` 转成大写后的副本。先预测 `"cpp learn"` 的字节数，再运行验证。

## 检索练习

合上讲义回答：`std::string::size()` 与 JavaScript 的 `String.prototype.length` 分别在数什么？为什么 `std::string` 能隐式转换成 `std::string_view`，这个转换会带来什么风险？

常见误区：把 `size()` 当成字符数（非 ASCII 文本会给出比预期大的值）；以为 `std::string` 像 JavaScript 字符串一样不可变；改 `s[s.size()]`（那是空终止符，改了是未定义行为）。
