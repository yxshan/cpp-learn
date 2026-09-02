#include <array>
#include <iostream>
#include <memory>

int main() {
  const std::array<int, 3> source{3, 5, 8};
  std::allocator<int> allocator;
  int* storage = allocator.allocate(2);

  const auto result = std::ranges::uninitialized_copy(
      source.begin(), source.end(), storage, storage + 2);

  std::cout << "copied=" << result.out - storage << '\n';
  std::cout << "remaining=" << source.end() - result.in << '\n';
  std::cout << "values=" << storage[0] << ',' << storage[1] << '\n';

  std::destroy(storage, result.out);
  allocator.deallocate(storage, 2);
}
