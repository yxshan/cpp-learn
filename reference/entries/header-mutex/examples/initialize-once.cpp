#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::once_flag flag;
  int calls = 0;
  int value = 0;

  const auto initialize = [&] {
    ++calls;
    value = 42;
  };

  std::thread first([&] { std::call_once(flag, initialize); });
  std::thread second([&] { std::call_once(flag, initialize); });

  first.join();
  second.join();

  std::cout << "calls=" << calls << '\n';
  std::cout << "value=" << value << '\n';
}
