#include <iostream>

int main() {
    int left{};
    int right{};

    if (std::cin >> left >> right) {
        std::cout << left + right << '\n';
    } else {
        std::cout << "invalid input\n";
    }
}
