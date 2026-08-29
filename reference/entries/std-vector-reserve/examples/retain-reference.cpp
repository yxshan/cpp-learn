#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<std::string> services;
    services.reserve(3);
    services.push_back("api");

    const std::string* first = &services.front();
    services.push_back("worker");
    services.push_back("database");

    std::cout << *first << ' ' << std::boolalpha
              << (first == &services.front()) << '\n';
}
