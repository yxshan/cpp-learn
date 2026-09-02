#include <algorithm>
#include <iostream>
#include <vector>

int main() {
  std::vector values{1, 2, 2, 3, 2, 4};
  const auto new_end = std::remove(values.begin(), values.end(), 2);
  const auto removed = values.end() - new_end;
  values.erase(new_end, values.end());

  std::cout << "removed=" << removed << '\n';
  std::cout << "values=";
  for (std::size_t index = 0; index < values.size(); ++index) {
    std::cout << (index == 0 ? "" : ",") << values[index];
  }
  std::cout << '\n';
}
