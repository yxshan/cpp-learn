#include <iostream>
#include <mutex>
#include <stdexcept>

int main() {
  std::mutex mutex;
  int value = 0;
  bool caught = false;

  try {
    std::lock_guard<std::mutex> lock(mutex);
    value = 1;
    throw std::runtime_error("stop");
  } catch (const std::runtime_error&) {
    caught = true;
  }

  {
    std::lock_guard<std::mutex> lock(mutex);
    ++value;
  }

  std::cout << std::boolalpha;
  std::cout << "caught=" << caught << '\n';
  std::cout << "value=" << value << '\n';
}
