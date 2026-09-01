#include <iostream>
#include <ranges>
#include <span>

int main() {
    int values[4]{1, 2, 3, 4};
    std::span<int, 4> view{values};

    static_assert(std::ranges::view<decltype(view)>);
    static_assert(std::ranges::borrowed_range<decltype(view)>);

    std::cout << "extent=" << decltype(view)::extent << '\n';
    std::cout << "size=" << view.size() << '\n';
    std::cout << std::boolalpha;
    std::cout << "view=" << std::ranges::view<decltype(view)> << '\n';
    std::cout << "borrowed=" << std::ranges::borrowed_range<decltype(view)>
              << '\n';
}
