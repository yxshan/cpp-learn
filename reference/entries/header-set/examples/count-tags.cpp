#include <iostream>
#include <set>
#include <string>

int main() {
    const std::multiset<std::string> tags{"backend", "frontend", "backend"};

    std::cout << "backend=" << tags.count("backend") << '\n';
    std::cout << "frontend=" << tags.count("frontend") << '\n';
}
