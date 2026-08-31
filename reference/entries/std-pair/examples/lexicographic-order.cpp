#include <iostream>
#include <string>
#include <utility>

int main() {
    const std::pair<int, std::string> first{1, "cache"};
    const std::pair<int, std::string> second{1, "web"};

    std::cout << std::boolalpha;
    std::cout << "first-less=" << (first < second) << '\n';
    std::cout << "equal=" << (first == second) << '\n';
}
