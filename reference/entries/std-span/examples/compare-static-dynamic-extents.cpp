#include <iostream>
#include <span>

int main() {
    int values[4]{2, 4, 6, 8};
    std::span<int, 4> static_view{values};
    std::span<int> dynamic_view{values};

    int sum = 0;
    for (const int value : dynamic_view) {
        sum += value;
    }

    std::cout << "static_extent=" << decltype(static_view)::extent << '\n';
    std::cout << std::boolalpha;
    std::cout << "dynamic_extent="
              << (decltype(dynamic_view)::extent == std::dynamic_extent)
              << '\n';
    std::cout << "dynamic_size=" << dynamic_view.size() << '\n';
    std::cout << "sum=" << sum << '\n';
}
