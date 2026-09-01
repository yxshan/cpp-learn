#include <iostream>
#include <limits>
#include <sstream>
#include <string>

int main() {
    std::istringstream input{"42\nAda Lovelace\n"};
    int age{};
    input >> age;
    input.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    const auto ignored = input.gcount();

    std::string name;
    std::getline(input, name);

    std::cout << "age=" << age << " ignored=" << ignored << '\n';
    std::cout << "name=" << name << " gcount=" << input.gcount() << '\n';
}
