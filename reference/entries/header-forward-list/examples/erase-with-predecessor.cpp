#include <forward_list>
#include <iostream>

int main() {
    std::forward_list<int> values{1, 2, 3, 4, 5};
    auto previous = values.before_begin();
    auto current = values.begin();
    int erased = 0;

    while (current != values.end()) {
        if (*current % 2 == 0) {
            current = values.erase_after(previous);
            ++erased;
        } else {
            previous = current;
            ++current;
        }
    }

    std::cout << "erased=" << erased << '\n';
    std::cout << "values=";
    bool first = true;
    for (const int value : values) {
        std::cout << (first ? "" : ",") << value;
        first = false;
    }
    std::cout << '\n';
}
