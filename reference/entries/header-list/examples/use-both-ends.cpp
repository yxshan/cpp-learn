#include <iostream>
#include <list>

int main() {
    std::list<int> values{2, 3};
    values.push_front(1);
    values.push_back(4);

    std::cout << "front=" << values.front() << '\n';
    std::cout << "back=" << values.back() << '\n';
    std::cout << "size=" << values.size() << '\n';
    std::cout << "values=";
    bool first = true;
    for (const int value : values) {
        std::cout << (first ? "" : ",") << value;
        first = false;
    }
    std::cout << '\n';
}
