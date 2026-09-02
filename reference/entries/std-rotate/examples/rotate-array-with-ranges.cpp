#include <algorithm>
#include <array>
#include <iostream>

int main() {
  std::array values{10, 20, 30, 40};
  const auto result = std::ranges::rotate(values, values.begin() + 1);

  std::cout << "old_first_index=" << result.begin() - values.begin() << '\n';
  std::cout << "values=";
  for (std::size_t index = 0; index < values.size(); ++index) {
    std::cout << (index == 0 ? "" : ",") << values[index];
  }
  std::cout << '\n';
}
