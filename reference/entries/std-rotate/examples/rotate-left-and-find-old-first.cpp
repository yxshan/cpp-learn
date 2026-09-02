#include <algorithm>
#include <iostream>
#include <vector>

int main() {
  std::vector values{1, 2, 3, 4, 5};
  const auto old_first =
      std::rotate(values.begin(), values.begin() + 2, values.end());

  std::cout << "old_first_index=" << old_first - values.begin() << '\n';
  std::cout << "values=";
  for (std::size_t index = 0; index < values.size(); ++index) {
    std::cout << (index == 0 ? "" : ",") << values[index];
  }
  std::cout << '\n';
}
