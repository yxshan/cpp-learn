#include <iostream>
#include <thread>

int main() {
  const std::thread::id main_id = std::this_thread::get_id();
  std::thread::id worker_id;

  std::thread worker([&worker_id] {
    worker_id = std::this_thread::get_id();
    std::this_thread::yield();
  });
  worker.join();

  std::cout << std::boolalpha;
  std::cout << "main_valid=" << (main_id != std::thread::id{}) << '\n';
  std::cout << "different=" << (main_id != worker_id) << '\n';
  std::cout << "joined=" << (worker.get_id() == std::thread::id{}) << '\n';
}
