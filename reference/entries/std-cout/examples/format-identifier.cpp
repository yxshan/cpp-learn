#include <iostream>

int main() {
    const int identifier{42};

    std::cout << "decimal=" << identifier << '\n';
    std::cout << "hex=0x" << std::hex << identifier << '\n';
    std::cout << std::dec;
}
