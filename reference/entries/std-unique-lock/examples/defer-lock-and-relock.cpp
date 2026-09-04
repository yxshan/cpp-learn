#include <iostream>
#include <mutex>

int main() {
  std::mutex mutex;
  int value = 0;
  std::unique_lock<std::mutex> lock(mutex, std::defer_lock);

  std::cout << std::boolalpha;
  std::cout << "owns_before=" << lock.owns_lock() << '\n';

  lock.lock();
  value = 21;
  lock.unlock();

  lock.lock();
  value *= 2;
  std::cout << "owns_after_lock=" << lock.owns_lock() << '\n';
  std::cout << "value=" << value << '\n';
}
