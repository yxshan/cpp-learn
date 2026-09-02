#include <iostream>
#include <mutex>

int main() {
  std::mutex mutex;
  int value = 0;

  mutex.lock();
  {
    std::lock_guard<std::mutex> owner(mutex, std::adopt_lock);
    value = 7;
  }

  {
    std::lock_guard<std::mutex> owner(mutex);
    ++value;
  }

  std::cout << "value=" << value << '\n';
}
