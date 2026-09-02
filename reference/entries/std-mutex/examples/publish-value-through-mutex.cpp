#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  int value = 0;

  mutex.lock();
  std::thread worker([&] {
    std::lock_guard<std::mutex> lock(mutex);
    ++value;
  });

  value = 41;
  mutex.unlock();
  worker.join();

  std::cout << "value=" << value << '\n';
}
