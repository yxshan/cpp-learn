#include <array>
#include <iostream>
#include <memory>
#include <string>

int main() {
  const std::array<std::string, 2> source{"api", "worker"};
  std::allocator<std::string> allocator;
  std::string* storage = allocator.allocate(source.size());

  std::string* end =
      std::uninitialized_copy(source.begin(), source.end(), storage);

  std::cout << "constructed=" << end - storage << '\n';
  std::cout << "values=" << storage[0] << ',' << storage[1] << '\n';

  std::destroy(storage, end);
  allocator.deallocate(storage, source.size());
}
