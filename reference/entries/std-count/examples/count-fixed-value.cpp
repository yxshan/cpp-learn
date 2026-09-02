#include <algorithm>
#include <array>
#include <iostream>

int main() {
  const std::array values{2, 1, 2, 3, 2, 4, 5};
  std::cout << "twos=" << std::count(values.begin(), values.end(), 2) << '\n';
}
