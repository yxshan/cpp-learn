#include <future>
#include <iostream>
#include <stdexcept>
#include <string>

int fail_task() {
  throw std::runtime_error("task failed");
}

int main() {
  std::future<int> result = std::async(std::launch::async, fail_task);

  std::string message;
  try {
    static_cast<void>(result.get());
  } catch (const std::runtime_error& error) {
    message = error.what();
  }

  std::cout << std::boolalpha;
  std::cout << "caught=" << message << '\n';
  std::cout << "valid=" << result.valid() << '\n';
}
