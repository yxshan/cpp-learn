#include <iostream>
#include <iterator>
#include <list>

int main() {
    std::list<int> values{10, 20, 30};
    const auto saved = std::next(values.begin());
    values.insert(saved, 15);

    std::cout << "saved=" << *saved << '\n';
    std::cout << "values=";
    bool first = true;
    for (const int value : values) {
        std::cout << (first ? "" : ",") << value;
        first = false;
    }
    std::cout << '\n';
}
