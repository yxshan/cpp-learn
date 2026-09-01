#include <forward_list>
#include <iostream>
#include <iterator>

int main() {
    std::forward_list<int> values{10, 20, 30};
    int& saved = *std::next(values.begin());
    values.insert_after(values.begin(), 15);

    std::cout << "saved=" << saved << '\n';
    std::cout << "values=";
    bool first = true;
    for (const int value : values) {
        std::cout << (first ? "" : ",") << value;
        first = false;
    }
    std::cout << '\n';
}
