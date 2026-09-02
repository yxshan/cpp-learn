#include <algorithm>
#include <array>
#include <iostream>

struct Job {
  bool failed;
};

int main() {
  const std::array jobs{Job{false}, Job{false}, Job{false}};
  const bool all_healthy = std::ranges::none_of(
      jobs, [](bool failed) { return failed; }, &Job::failed);
  std::cout << std::boolalpha << "all_healthy=" << all_healthy << '\n';
}
