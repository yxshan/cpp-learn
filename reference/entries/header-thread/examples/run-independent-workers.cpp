#include <array>
#include <iostream>
#include <thread>

int main() {
  std::array<int, 2> results{};

  std::thread first([&results] { results[0] = 20; });
  std::thread second([&results] { results[1] = 22; });

  first.join();
  second.join();

  std::cout << "results=" << results[0] << ',' << results[1] << '\n';
  std::cout << "sum=" << results[0] + results[1] << '\n';
}
