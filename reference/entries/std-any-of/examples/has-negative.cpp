#include <algorithm>
#include <array>
#include <iostream>

int main() {
    const std::array<int, 4> balances{12, 4, -3, 8};
    const bool has_negative = std::any_of(balances.begin(), balances.end(),
                                          [](int value) { return value < 0; });

    std::cout << std::boolalpha << "negative=" << has_negative << '\n';
}
