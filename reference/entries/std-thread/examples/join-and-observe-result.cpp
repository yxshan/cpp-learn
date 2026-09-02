#include <iostream>
#include <thread>

int main() {
  int result = 0;
  std::thread worker([&result] { result = 42; });

  const bool before = worker.joinable();
  worker.join();

  std::cout << std::boolalpha;
  std::cout << "joinable_before=" << before << '\n';
  std::cout << "result=" << result << '\n';
  std::cout << "joinable_after=" << worker.joinable() << '\n';
}
