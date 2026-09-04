#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  std::unique_lock<std::mutex> owner(mutex);
  std::mutex* released = owner.release();
  bool contender_acquired = true;

  std::thread contender([&] {
    contender_acquired = mutex.try_lock();
    if (contender_acquired) {
      mutex.unlock();
    }
  });
  contender.join();

  std::cout << std::boolalpha;
  std::cout << "owns=" << owner.owns_lock() << '\n';
  std::cout << "associated=" << (owner.mutex() != nullptr) << '\n';
  std::cout << "contender_acquired=" << contender_acquired << '\n';

  released->unlock();
}
