#include <iostream>
#include <memory>
#include <type_traits>
#include <vector>

int main() {
  std::vector<int, std::allocator<int>> values{3, 5};
  using Allocator = decltype(values)::allocator_type;

  std::cout << std::boolalpha;
  std::cout << "default_allocator="
            << std::is_same_v<Allocator, std::allocator<int>> << '\n';
  std::cout << "values=" << values[0] << ',' << values[1] << '\n';
}
