#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

int main() {
  std::vector<std::string> source{"api", "worker"};
  std::vector<std::string> destination(source.size());

  const auto result = std::ranges::move(source, destination.begin());

  std::cout << "written=" << result.out - destination.begin() << '\n';
  std::cout << "values=" << destination[0] << ',' << destination[1] << '\n';
}
