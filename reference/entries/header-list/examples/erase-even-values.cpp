#include <iostream>
#include <list>

int main() {
    std::list<int> values{1, 2, 3, 4, 5, 6};
    const auto erased = std::erase_if(values, [](int value) {
        return value % 2 == 0;
    });

    std::cout << "erased=" << erased << '\n';
    std::cout << "values=";
    bool first = true;
    for (const int value : values) {
        std::cout << (first ? "" : ",") << value;
        first = false;
    }
    std::cout << '\n';
}
