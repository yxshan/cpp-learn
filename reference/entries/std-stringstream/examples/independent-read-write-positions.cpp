#include <iostream>
#include <sstream>

int main() {
    std::stringstream stream{"abc"};
    stream << 'X';
    std::cout << "buffer=" << stream.str() << '\n';

    stream.seekg(0);
    char first{};
    stream.get(first);
    std::cout << "first=" << first << '\n';
}
