#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  bool acquired = true;

  mutex.lock();
  std::thread contender([&] {
    acquired = mutex.try_lock();
    if (acquired) {
      mutex.unlock();
    }
  });
  contender.join();
  mutex.unlock();

  std::cout << std::boolalpha << "acquired=" << acquired << '\n';
}
