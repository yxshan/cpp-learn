#include <iostream>

int main() {
    int value{};
    int count{};
    int total{};

    while (std::cin >> value) {
        ++count;
        total += value;
    }

    std::cout << count << ' ' << total << '\n';
}
