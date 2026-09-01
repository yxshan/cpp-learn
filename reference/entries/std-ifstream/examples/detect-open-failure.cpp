#include <cstdio>
#include <fstream>
#include <iostream>

int main() {
    constexpr const char* path = "missing-input.txt";
    std::remove(path);
    std::ifstream input{path};

    std::cout << std::boolalpha << "open=" << input.is_open() << '\n';
    std::cout << "fail=" << input.fail() << '\n';
}
