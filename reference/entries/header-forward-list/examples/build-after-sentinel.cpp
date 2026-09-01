#include <forward_list>
#include <iostream>

int main() {
    std::forward_list<int> values;
    auto position = values.before_begin();
    position = values.insert_after(position, 1);
    position = values.insert_after(position, 2);
    values.insert_after(position, 3);

    std::cout << "values=";
    bool first = true;
    for (const int value : values) {
        std::cout << (first ? "" : ",") << value;
        first = false;
    }
    std::cout << '\n';
}
