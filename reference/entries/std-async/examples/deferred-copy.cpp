#include <chrono>
#include <future>
#include <iostream>

int increment(int value) {
  return value + 1;
}

int main() {
  int source = 41;
  std::future<int> result =
      std::async(std::launch::deferred, increment, source);
  source = 100;

  const std::future_status status =
      result.wait_for(std::chrono::seconds{0});
  std::cout << "status="
            << (status == std::future_status::deferred ? "deferred" : "other")
            << '\n';
  std::cout << "result=" << result.get() << '\n';
  std::cout << "source=" << source << '\n';
}
