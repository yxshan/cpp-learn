#include <array>
#include <iostream>
#include <span>

int main() {
    std::array<int, 5> values{1, 2, 3, 4, 5};
    std::span view{values};
    auto middle = view.subspan<1, 3>();
    for (int& value : middle) {
        value *= 10;
    }

    std::cout << "sub_extent=" << decltype(middle)::extent << '\n';
    std::cout << "values=";
    bool first = true;
    for (const int value : values) {
        std::cout << (first ? "" : ",") << value;
        first = false;
    }
    std::cout << '\n';
}
