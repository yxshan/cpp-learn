#include <algorithm>
#include <array>
#include <iostream>
#include <memory>

int main() {
  std::array<std::unique_ptr<int>, 3> source{
      std::make_unique<int>(4),
      std::make_unique<int>(7),
      std::make_unique<int>(9),
  };
  std::array<std::unique_ptr<int>, 3> destination{};

  const auto output_end =
      std::move(source.begin(), source.end(), destination.begin());

  std::cout << "written=" << output_end - destination.begin() << '\n';
  std::cout << "values=" << *destination[0] << ',' << *destination[1] << ','
            << *destination[2] << '\n';
}
