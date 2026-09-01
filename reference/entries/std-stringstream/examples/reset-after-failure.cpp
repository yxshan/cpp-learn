#include <iostream>
#include <sstream>

int main() {
    std::stringstream stream{"bad"};
    int value{};
    stream >> value;
    std::cout << std::boolalpha << "first_failed=" << stream.fail() << '\n';

    stream.clear();
    stream.str("42");
    stream >> value;
    std::cout << "value=" << value << '\n';
}
