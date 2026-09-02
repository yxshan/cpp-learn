#include <iostream>
#include <thread>
#include <utility>

int main() {
  int value = 0;
  std::thread source([&value] { value = 7; });
  std::thread owner = std::move(source);

  std::cout << std::boolalpha;
  std::cout << "source_joinable=" << source.joinable() << '\n';
  std::cout << "owner_joinable=" << owner.joinable() << '\n';

  owner.join();
  std::cout << "value=" << value << '\n';
}
