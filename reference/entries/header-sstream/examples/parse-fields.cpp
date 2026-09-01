#include <iostream>
#include <sstream>
#include <string>

int main() {
    std::istringstream input{"Ada 98"};
    std::string name;
    int score{};

    if (input >> name >> score) {
        std::cout << "name=" << name << " score=" << score << '\n';
    }
}
