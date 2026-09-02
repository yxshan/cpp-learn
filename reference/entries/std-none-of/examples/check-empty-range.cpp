#include <algorithm>
#include <array>
#include <iostream>

int main() {
  const std::array<int, 0> values{};
  const bool has_no_negative =
      std::none_of(values.begin(), values.end(), [](int value) {
        return value < 0;
      });
  std::cout << std::boolalpha
            << "empty_has_no_negative=" << has_no_negative << '\n';
}
